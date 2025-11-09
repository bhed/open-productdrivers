import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import 'event_type.dart';
import 'track_payload.dart';

/// PII Detection Patterns
class _PIIDetector {
  static final _patterns = {
    'email': RegExp(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'),
    'phone': RegExp(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'),
    'creditCard': RegExp(r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b'),
    'ssn': RegExp(r'\b\d{3}-\d{2}-\d{4}\b'),
    'ipv4': RegExp(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'),
  };

  static bool containsPII(dynamic value) {
    if (value is String) {
      for (var pattern in _patterns.values) {
        if (pattern.hasMatch(value)) {
          return true;
        }
      }
      return false;
    } else if (value is Map) {
      return value.values.any((v) => containsPII(v));
    } else if (value is List) {
      return value.any((v) => containsPII(v));
    }
    return false;
  }

  static List<String> scanForPII(dynamic obj, [String path = '']) {
    final violations = <String>[];

    if (obj is String) {
      if (containsPII(obj)) {
        violations.add(path.isEmpty ? 'value' : path);
      }
    } else if (obj is List) {
      for (var i = 0; i < obj.length; i++) {
        violations.addAll(scanForPII(obj[i], '$path[$i]'));
      }
    } else if (obj is Map) {
      obj.forEach((key, value) {
        final newPath = path.isEmpty ? key.toString() : '$path.$key';
        violations.addAll(scanForPII(value, newPath));
      });
    }

    return violations;
  }
}

/// ProductDrivers SDK for Flutter
/// 
/// Usage:
/// ```dart
/// await ProductDrivers.init(
///   projectKey: 'YOUR_PROJECT_KEY',
///   apiBaseUrl: 'https://your-project.supabase.co/functions/v1',
/// );
/// 
/// ProductDrivers.track(
///   event: EventType.featureUsed,
///   feature: 'help_button',
///   journey: 'checkout',
/// );
/// ```
class ProductDrivers {
  static const String _sessionIdKey = 'productdrivers_session';
  static const String _queueKey = 'productdrivers_queue';
  static const int _maxBatchSize = 50;
  static const Duration _flushInterval = Duration(seconds: 30);
  static const int _maxRetries = 3;

  static String? _projectKey;
  static String? _apiKey;
  static String? _apiBaseUrl;
  static String? _sessionId;
  static SharedPreferences? _prefs;
  static bool _isInitialized = false;
  static bool _debug = false;
  static bool _blockPII = false;

  static final List<_QueuedEvent> _eventQueue = [];
  static Timer? _flushTimer;
  static bool _isFlushing = false;

  /// Initialize the SDK
  /// @param projectKey Your ProductDrivers project key
  /// @param apiKey Your Supabase anon key (required)
  /// @param apiBaseUrl Your Supabase project URL (e.g., 'https://your-project.supabase.co/functions/v1')
  /// @param debug Enable debug logging
  /// @param blockPII Enable PII detection and blocking
  static Future<void> init({
    required String projectKey,
    required String apiKey,
    required String apiBaseUrl,
    bool debug = false,
    bool blockPII = false,
  }) async {
    if (_isInitialized) {
      if (debug) print('[ProductDrivers] Already initialized');
      return;
    }

    _projectKey = projectKey;
    _apiKey = apiKey;
    _apiBaseUrl = apiBaseUrl;
    _debug = debug;
    _blockPII = blockPII;

    // Initialize SharedPreferences
    _prefs = await SharedPreferences.getInstance();

    // Load or create session ID
    _sessionId = _prefs!.getString(_sessionIdKey);
    if (_sessionId == null) {
      _sessionId = const Uuid().v4();
      await _prefs!.setString(_sessionIdKey, _sessionId!);
    }

    // Load queued events
    await _loadQueue();

    // Start auto-flush
    _scheduleFlush();

    _isInitialized = true;
    if (_debug) print('[ProductDrivers] Initialized with session: $_sessionId');
  }

  /// Track an event
  static void track({
    required EventType event,
    String? journey,
    String? step,
    String? feature,
    String? name, // For CUSTOM events
    String? behaviorType, // For USER_BEHAVIOR events
    String? elementSelector, // For USER_BEHAVIOR events
    String? elementText, // For USER_BEHAVIOR events
    String? pageUrl, // For USER_BEHAVIOR events
    num? value,
    Map<String, dynamic>? meta,
  }) {
    if (!_isInitialized) {
      print('[ProductDrivers] SDK not initialized. Call init() first.');
      return;
    }

    // Check for PII if blockPII is enabled
    if (_blockPII) {
      final dataToCheck = {
        'journey': journey,
        'step': step,
        'feature': feature,
        'name': name,
        'behaviorType': behaviorType,
        'elementSelector': elementSelector,
        'elementText': elementText,
        'pageUrl': pageUrl,
        'value': value,
        'meta': meta,
      };
      final violations = _PIIDetector.scanForPII(dataToCheck);
      if (violations.isNotEmpty) {
        print(
          '[ProductDrivers] Event blocked: PII detected in fields: ${violations.join(', ')}. '
          'Remove sensitive data or disable blockPII option.'
        );
        if (_debug) print('[ProductDrivers] Blocked data: $dataToCheck');
        return;
      }
    }

    final payload = TrackPayload(
      projectKey: _projectKey!,
      sessionId: _sessionId,
      event: event,
      journey: journey,
      step: step,
      feature: feature,
      name: name,
      behaviorType: behaviorType,
      elementSelector: elementSelector,
      elementText: elementText,
      pageUrl: pageUrl,
      value: value,
      ts: DateTime.now().millisecondsSinceEpoch,
      meta: meta,
    );

    _eventQueue.add(_QueuedEvent(payload, 0, DateTime.now().millisecondsSinceEpoch));
    _saveQueue();

    if (_debug) print('[ProductDrivers] Event queued: ${event.value}');

    // Flush if batch size reached
    if (_eventQueue.length >= _maxBatchSize) {
      flush();
    }
  }

  /// Identify a user
  static Future<void> identify(
    String userId, {
    Map<String, dynamic>? traits,
  }) async {
    if (!_isInitialized) {
      print('[ProductDrivers] SDK not initialized');
      return;
    }

    // Check for PII in traits if blockPII is enabled
    if (_blockPII && traits != null) {
      final violations = _PIIDetector.scanForPII(traits);
      if (violations.isNotEmpty) {
        print(
          '[ProductDrivers] Identify blocked: PII detected in traits: ${violations.join(', ')}. '
          'Remove sensitive data or disable blockPII option.'
        );
        if (_debug) print('[ProductDrivers] Blocked traits: $traits');
        return;
      }
    }

    try {
      final payload = IdentifyPayload(
        projectKey: _projectKey!,
        userId: userId,
        sessionId: _sessionId!,
        traits: traits,
      );

      final response = await http.post(
        Uri.parse('$_apiBaseUrl/identify'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_apiKey',
        },
        body: jsonEncode(payload.toJson()),
      );

      if (response.statusCode != 200) {
        if (_debug) print('[ProductDrivers] Identify failed: ${response.statusCode}');
      }
    } catch (e) {
      if (_debug) print('[ProductDrivers] Identify error: $e');
    }
  }

  /// Manually flush queued events
  static Future<void> flush() async {
    if (!_isInitialized || _isFlushing || _eventQueue.isEmpty) {
      return;
    }

    _isFlushing = true;

    final eventsToSend = _eventQueue.take(_maxBatchSize).toList();
    _eventQueue.removeRange(0, eventsToSend.length);

    try {
      final batchPayload = {
        'projectKey': _projectKey,
        'events': eventsToSend.map((e) => e.payload.toJson()).toList(),
      };

      final response = await http.post(
        Uri.parse('$_apiBaseUrl/track'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_apiKey',
        },
        body: jsonEncode(batchPayload),
      );

      if (response.statusCode == 200) {
        if (_debug) print('[ProductDrivers] Flushed ${eventsToSend.length} events');
        await _saveQueue();
      } else {
        // Re-queue with retry count
        for (final event in eventsToSend) {
          if (event.retryCount < _maxRetries) {
            _eventQueue.add(_QueuedEvent(
              event.payload,
              event.retryCount + 1,
              event.timestamp,
            ));
          }
        }
        await _saveQueue();
      }
    } catch (e) {
      if (_debug) print('[ProductDrivers] Flush error: $e');
      // Re-queue on error
      _eventQueue.insertAll(0, eventsToSend);
      await _saveQueue();
    } finally {
      _isFlushing = false;
    }
  }

  static void _scheduleFlush() {
    _flushTimer?.cancel();
    _flushTimer = Timer.periodic(_flushInterval, (_) => flush());
  }

  static Future<void> _loadQueue() async {
    try {
      final json = _prefs!.getString(_queueKey);
      if (json != null) {
        final List<dynamic> list = jsonDecode(json);
        _eventQueue.addAll(list.map((e) => _QueuedEvent.fromJson(e)));
        if (_debug) print('[ProductDrivers] Loaded ${_eventQueue.length} queued events');
      }
    } catch (e) {
      if (_debug) print('[ProductDrivers] Failed to load queue: $e');
    }
  }

  static Future<void> _saveQueue() async {
    try {
      final json = jsonEncode(_eventQueue.map((e) => e.toJson()).toList());
      await _prefs!.setString(_queueKey, json);
    } catch (e) {
      if (_debug) print('[ProductDrivers] Failed to save queue: $e');
    }
  }

  /// Dispose resources
  static void dispose() {
    _flushTimer?.cancel();
    _isInitialized = false;
  }
}

class _QueuedEvent {
  final TrackPayload payload;
  final int retryCount;
  final int timestamp;

  _QueuedEvent(this.payload, this.retryCount, this.timestamp);

  Map<String, dynamic> toJson() => {
        'payload': payload.toJson(),
        'retryCount': retryCount,
        'timestamp': timestamp,
      };

  factory _QueuedEvent.fromJson(Map<String, dynamic> json) {
    return _QueuedEvent(
      TrackPayload.fromJson(json['payload']),
      json['retryCount'] as int,
      json['timestamp'] as int,
    );
  }
}

