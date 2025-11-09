package com.productdrivers

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import com.google.gson.Gson
import java.io.IOException
import java.util.*
import java.util.concurrent.TimeUnit

/**
 * PII Detection Utility
 */
internal object PIIDetector {
    private val patterns = mapOf(
        "email" to Regex("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"),
        "phone" to Regex("(\\+?\\d{1,3}[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}"),
        "creditCard" to Regex("\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b"),
        "ssn" to Regex("\\b\\d{3}-\\d{2}-\\d{4}\\b"),
        "ipv4" to Regex("\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b")
    )
    
    fun containsPII(value: Any?): Boolean {
        return when (value) {
            is String -> patterns.values.any { it.containsMatchIn(value) }
            is Map<*, *> -> value.values.any { containsPII(it) }
            is List<*> -> value.any { containsPII(it) }
            else -> false
        }
    }
    
    fun scanForPII(obj: Any?, path: String = ""): List<String> {
        val violations = mutableListOf<String>()
        
        when (obj) {
            is String -> {
                if (containsPII(obj)) {
                    violations.add(if (path.isEmpty()) "value" else path)
                }
            }
            is List<*> -> {
                obj.forEachIndexed { index, item ->
                    violations.addAll(scanForPII(item, "$path[$index]"))
                }
            }
            is Map<*, *> -> {
                obj.forEach { (key, value) ->
                    val newPath = if (path.isEmpty()) key.toString() else "$path.$key"
                    violations.addAll(scanForPII(value, newPath))
                }
            }
        }
        
        return violations
    }
}

/**
 * ProductDrivers SDK for Android
 * 
 * Usage:
 * ```kotlin
 * ProductDrivers.init(
 *     context = context,
 *     projectKey = "YOUR_PROJECT_KEY",
 *     apiBaseUrl = "https://your-project.supabase.co/functions/v1"
 * )
 * 
 * ProductDrivers.track(
 *     event = EventType.FEATURE_USED,
 *     feature = "help_button",
 *     journey = "checkout"
 * )
 * ```
 */
object ProductDrivers {
    private const val PREFS_NAME = "productdrivers_prefs"
    private const val KEY_SESSION_ID = "session_id"
    private const val KEY_QUEUE = "event_queue"
    
    private const val MAX_BATCH_SIZE = 50
    private const val FLUSH_INTERVAL_MS = 30000L // 30 seconds
    private const val MAX_RETRIES = 3
    
    private lateinit var projectKey: String
    private lateinit var apiKey: String
    private lateinit var apiBaseUrl: String
    private lateinit var prefs: SharedPreferences
    private lateinit var client: OkHttpClient
    private lateinit var gson: Gson
    
    private var sessionId: String = ""
    private val eventQueue = mutableListOf<QueuedEvent>()
    private var flushJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    private var isInitialized = false
    private var blockPII = false
    private var debug = false
    
    /**
     * Initialize the SDK
     * @param context Android application context
     * @param projectKey Your ProductDrivers project key
     * @param apiKey Your Supabase anon key (required)
     * @param apiBaseUrl Your Supabase project URL (e.g., "https://your-project.supabase.co/functions/v1")
     * @param debug Enable debug logging
     * @param blockPII Enable PII detection and blocking
     */
    fun init(
        context: Context,
        projectKey: String,
        apiKey: String,
        apiBaseUrl: String,
        debug: Boolean = false,
        blockPII: Boolean = false
    ) {
        if (isInitialized) {
            if (debug) println("[ProductDrivers] Already initialized")
            return
        }
        
        this.projectKey = projectKey
        this.apiKey = apiKey
        this.apiBaseUrl = apiBaseUrl
        this.debug = debug
        this.blockPII = blockPII
        this.prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        this.gson = Gson()
        
        this.client = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
        
        // Load or create session ID
        sessionId = prefs.getString(KEY_SESSION_ID, null) ?: run {
            val newId = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_SESSION_ID, newId).apply()
            newId
        }
        
        // Load queued events
        loadQueue()
        
        // Start auto-flush
        scheduleFlush()
        
        isInitialized = true
        if (debug) println("[ProductDrivers] Initialized with session: $sessionId")
    }
    
    /**
     * Track an event
     */
    fun track(
        event: EventType,
        userId: String? = null,
        journey: String? = null,
        step: String? = null,
        feature: String? = null,
        name: String? = null, // For CUSTOM events
        behaviorType: String? = null, // For USER_BEHAVIOR events
        elementSelector: String? = null, // For USER_BEHAVIOR events
        elementText: String? = null, // For USER_BEHAVIOR events
        pageUrl: String? = null, // For USER_BEHAVIOR events
        value: Number? = null,
        meta: Map<String, Any>? = null
    ) {
        if (!isInitialized) {
            println("[ProductDrivers] SDK not initialized. Call init() first.")
            return
        }
        
        // Check for PII if blockPII is enabled
        if (blockPII) {
            val dataToCheck = mapOf(
                "userId" to userId,
                "journey" to journey,
                "step" to step,
                "feature" to feature,
                "name" to name,
                "behaviorType" to behaviorType,
                "elementSelector" to elementSelector,
                "elementText" to elementText,
                "pageUrl" to pageUrl,
                "value" to value,
                "meta" to meta
            )
            val violations = PIIDetector.scanForPII(dataToCheck)
            if (violations.isNotEmpty()) {
                println(
                    "[ProductDrivers] Event blocked: PII detected in fields: ${violations.joinToString(", ")}. " +
                    "Remove sensitive data or disable blockPII option."
                )
                if (debug) println("[ProductDrivers] Blocked data: $dataToCheck")
                return
            }
        }
        
        val payload = TrackPayload(
            projectKey = projectKey,
            sessionId = sessionId,
            userId = userId,
            event = event.value,
            journey = journey,
            step = step,
            feature = feature,
            name = name,
            behaviorType = behaviorType,
            elementSelector = elementSelector,
            elementText = elementText,
            pageUrl = pageUrl,
            value = value,
            ts = System.currentTimeMillis(),
            meta = meta
        )
        
        synchronized(eventQueue) {
            eventQueue.add(QueuedEvent(payload, 0, System.currentTimeMillis()))
            saveQueue()
        }
        
        // Flush if batch size reached
        if (eventQueue.size >= MAX_BATCH_SIZE) {
            flush()
        }
    }
    
    /**
     * Identify a user
     */
    fun identify(userId: String, traits: Map<String, Any>? = null) {
        if (!isInitialized) {
            println("[ProductDrivers] SDK not initialized")
            return
        }
        
        // Check for PII in traits if blockPII is enabled
        if (blockPII && traits != null) {
            val violations = PIIDetector.scanForPII(traits)
            if (violations.isNotEmpty()) {
                println(
                    "[ProductDrivers] Identify blocked: PII detected in traits: ${violations.joinToString(", ")}. " +
                    "Remove sensitive data or disable blockPII option."
                )
                if (debug) println("[ProductDrivers] Blocked traits: $traits")
                return
            }
        }
        
        scope.launch {
            try {
                val payload = IdentifyPayload(
                    projectKey = projectKey,
                    userId = userId,
                    sessionId = sessionId,
                    traits = traits
                )
                
                val json = gson.toJson(payload)
                val body = json.toRequestBody("application/json".toMediaType())
                
                val request = Request.Builder()
                    .url("$apiBaseUrl/identify")
                    .post(body)
                    .addHeader("Authorization", "Bearer $apiKey")
                    .build()
                
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        println("[ProductDrivers] Identify failed: ${response.code}")
                    }
                }
            } catch (e: Exception) {
                println("[ProductDrivers] Identify error: ${e.message}")
            }
        }
    }
    
    /**
     * Manually flush queued events
     */
    fun flush() {
        if (!isInitialized || eventQueue.isEmpty()) return
        
        scope.launch {
            val eventsToSend = synchronized(eventQueue) {
                eventQueue.take(MAX_BATCH_SIZE).also {
                    eventQueue.removeAll(it.toSet())
                }
            }
            
            if (eventsToSend.isEmpty()) return@launch
            
            try {
                val batchPayload = BatchPayload(
                    projectKey = projectKey,
                    events = eventsToSend.map { it.payload }
                )
                
                val json = gson.toJson(batchPayload)
                val body = json.toRequestBody("application/json".toMediaType())
                
                val request = Request.Builder()
                    .url("$apiBaseUrl/track")
                    .post(body)
                    .addHeader("Authorization", "Bearer $apiKey")
                    .build()
                
                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        saveQueue()
                    } else {
                        // Re-queue with retry count
                        synchronized(eventQueue) {
                            eventsToSend.forEach { event ->
                                if (event.retryCount < MAX_RETRIES) {
                                    eventQueue.add(event.copy(retryCount = event.retryCount + 1))
                                }
                            }
                            saveQueue()
                        }
                    }
                }
            } catch (e: IOException) {
                // Re-queue on network error
                synchronized(eventQueue) {
                    eventQueue.addAll(0, eventsToSend)
                    saveQueue()
                }
            }
        }
    }
    
    private fun scheduleFlush() {
        flushJob?.cancel()
        flushJob = scope.launch {
            while (isActive) {
                delay(FLUSH_INTERVAL_MS)
                flush()
            }
        }
    }
    
    private fun loadQueue() {
        try {
            val json = prefs.getString(KEY_QUEUE, null) ?: return
            val events = gson.fromJson(json, Array<QueuedEvent>::class.java)
            eventQueue.addAll(events)
        } catch (e: Exception) {
            println("[ProductDrivers] Failed to load queue: ${e.message}")
        }
    }
    
    private fun saveQueue() {
        try {
            val json = gson.toJson(eventQueue)
            prefs.edit().putString(KEY_QUEUE, json).apply()
        } catch (e: Exception) {
            println("[ProductDrivers] Failed to save queue: ${e.message}")
        }
    }
}

// Data classes
enum class EventType(val value: String) {
    JOURNEY_START("JOURNEY_START"),
    JOURNEY_COMPLETE("JOURNEY_COMPLETE"),
    STEP_VIEW("STEP_VIEW"),
    FEATURE_USED("FEATURE_USED"),
    JOURNEY_SATISFACTION("JOURNEY_SATISFACTION"),
    USER_BEHAVIOR("USER_BEHAVIOR"),
    CUSTOM("CUSTOM")
}

data class TrackPayload(
    val projectKey: String,
    val sessionId: String,
    val userId: String? = null,
    val event: String,
    val journey: String? = null,
    val step: String? = null,
    val feature: String? = null,
    val name: String? = null, // For CUSTOM events
    val behaviorType: String? = null, // For USER_BEHAVIOR events
    val elementSelector: String? = null, // For USER_BEHAVIOR events
    val elementText: String? = null, // For USER_BEHAVIOR events
    val pageUrl: String? = null, // For USER_BEHAVIOR events
    val value: Number? = null,
    val ts: Long? = null,
    val meta: Map<String, Any>? = null
)

data class IdentifyPayload(
    val projectKey: String,
    val userId: String,
    val sessionId: String,
    val traits: Map<String, Any>? = null
)

data class BatchPayload(
    val projectKey: String,
    val events: List<TrackPayload>
)

data class QueuedEvent(
    val payload: TrackPayload,
    val retryCount: Int,
    val timestamp: Long
)

