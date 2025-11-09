import 'event_type.dart';

/// Payload for tracking events
class TrackPayload {
  final String projectKey;
  final String? sessionId;
  final String? userId;
  final EventType event;
  final String? journey;
  final String? step;
  final String? feature;
  final String? name; // For CUSTOM events
  final String? behaviorType; // For USER_BEHAVIOR events
  final String? elementSelector; // For USER_BEHAVIOR events
  final String? elementText; // For USER_BEHAVIOR events
  final String? pageUrl; // For USER_BEHAVIOR events
  final num? value;
  final int? ts;
  final Map<String, dynamic>? meta;

  TrackPayload({
    required this.projectKey,
    this.sessionId,
    this.userId,
    required this.event,
    this.journey,
    this.step,
    this.feature,
    this.name,
    this.behaviorType,
    this.elementSelector,
    this.elementText,
    this.pageUrl,
    this.value,
    this.ts,
    this.meta,
  });

  Map<String, dynamic> toJson() {
    return {
      'projectKey': projectKey,
      if (sessionId != null) 'sessionId': sessionId,
      if (userId != null) 'userId': userId,
      'event': event.value,
      if (journey != null) 'journey': journey,
      if (step != null) 'step': step,
      if (feature != null) 'feature': feature,
      if (name != null) 'name': name,
      if (behaviorType != null) 'behaviorType': behaviorType,
      if (elementSelector != null) 'elementSelector': elementSelector,
      if (elementText != null) 'elementText': elementText,
      if (pageUrl != null) 'pageUrl': pageUrl,
      if (value != null) 'value': value,
      if (ts != null) 'ts': ts,
      if (meta != null) 'meta': meta,
    };
  }

  factory TrackPayload.fromJson(Map<String, dynamic> json) {
    return TrackPayload(
      projectKey: json['projectKey'] as String,
      sessionId: json['sessionId'] as String?,
      userId: json['userId'] as String?,
      event: EventType.values.firstWhere(
        (e) => e.value == json['event'],
        orElse: () => EventType.custom,
      ),
      journey: json['journey'] as String?,
      step: json['step'] as String?,
      feature: json['feature'] as String?,
      name: json['name'] as String?,
      behaviorType: json['behaviorType'] as String?,
      elementSelector: json['elementSelector'] as String?,
      elementText: json['elementText'] as String?,
      pageUrl: json['pageUrl'] as String?,
      value: json['value'] as num?,
      ts: json['ts'] as int?,
      meta: json['meta'] as Map<String, dynamic>?,
    );
  }
}

/// Payload for identifying users
class IdentifyPayload {
  final String projectKey;
  final String userId;
  final String sessionId;
  final Map<String, dynamic>? traits;

  IdentifyPayload({
    required this.projectKey,
    required this.userId,
    required this.sessionId,
    this.traits,
  });

  Map<String, dynamic> toJson() {
    return {
      'projectKey': projectKey,
      'userId': userId,
      'sessionId': sessionId,
      if (traits != null) 'traits': traits,
    };
  }
}

