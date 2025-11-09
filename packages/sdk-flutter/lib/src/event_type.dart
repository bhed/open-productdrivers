/// Event types supported by productdrivers
enum EventType {
  journeyStart('JOURNEY_START'),
  journeyComplete('JOURNEY_COMPLETE'),
  stepView('STEP_VIEW'),
  featureUsed('FEATURE_USED'),
  journeySatisfaction('JOURNEY_SATISFACTION'),
  userBehavior('USER_BEHAVIOR'),
  custom('CUSTOM');

  const EventType(this.value);
  final String value;
}

