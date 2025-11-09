/**
 * Zod validation schemas for productdrivers payloads
 * Used for runtime validation in Edge Functions
 */

import { z } from 'zod';
import { EventType } from './types';

/**
 * Base event schema (with projectKey)
 */
const baseEventSchema = z.object({
  projectKey: z.string().min(1),
  userId: z.string().optional(),
  sessionId: z.string().uuid().optional(),
  ts: z.number().int().positive().optional(),
  meta: z.record(z.any()).optional(),
});

/**
 * Base event schema (without projectKey - for batch events)
 */
const baseEventSchemaWithoutKey = z.object({
  userId: z.string().optional(),
  sessionId: z.string().uuid().optional(),
  ts: z.number().int().positive().optional(),
  meta: z.record(z.any()).optional(),
});

/**
 * Journey event schema
 */
export const journeyEventSchema = baseEventSchema.extend({
  event: z.enum([
    EventType.JOURNEY_START,
    EventType.JOURNEY_COMPLETE,
    EventType.STEP_VIEW,
  ]),
  journey: z.string().min(1),
  step: z.string().optional(),
});

/**
 * Feature event schema
 */
export const featureEventSchema = baseEventSchema.extend({
  event: z.literal(EventType.FEATURE_USED),
  journey: z.string().optional(),
  feature: z.string().min(1),
  value: z.number().optional(),
});

/**
 * Satisfaction event schema
 */
export const satisfactionEventSchema = baseEventSchema.extend({
  event: z.literal(EventType.JOURNEY_SATISFACTION),
  journey: z.string().min(1),
  value: z.number().int().min(1).max(10),
  feedback: z.string().optional(),
});

/**
 * Custom event schema
 */
export const customEventSchema = baseEventSchema.extend({
  event: z.literal(EventType.CUSTOM),
  name: z.string().min(1),
  journey: z.string().optional(),
  value: z.number().optional(),
});

/**
 * User behavior event schema
 */
export const userBehaviorEventSchema = baseEventSchema.extend({
  event: z.literal(EventType.USER_BEHAVIOR),
  behaviorType: z.string().min(1),
  journey: z.string().optional(),
  step: z.string().optional(),
  feature: z.string().optional(),
  elementSelector: z.string().optional(),
  elementText: z.string().optional(),
  pageUrl: z.string().optional(),
  value: z.number().optional(),
});

/**
 * Union schema for all track payloads
 */
export const trackPayloadSchema = z.discriminatedUnion('event', [
  journeyEventSchema,
  featureEventSchema,
  satisfactionEventSchema,
  customEventSchema,
  userBehaviorEventSchema,
]);

/**
 * Event schemas without projectKey (for batch)
 */
const journeyEventSchemaWithoutKey = baseEventSchemaWithoutKey.extend({
  event: z.enum([
    EventType.JOURNEY_START,
    EventType.JOURNEY_COMPLETE,
    EventType.STEP_VIEW,
  ]),
  journey: z.string().min(1),
  step: z.string().optional(),
});

const featureEventSchemaWithoutKey = baseEventSchemaWithoutKey.extend({
  event: z.literal(EventType.FEATURE_USED),
  journey: z.string().optional(),
  feature: z.string().min(1),
  value: z.number().optional(),
});

const satisfactionEventSchemaWithoutKey = baseEventSchemaWithoutKey.extend({
  event: z.literal(EventType.JOURNEY_SATISFACTION),
  journey: z.string().min(1),
  value: z.number().int().min(1).max(10),
  feedback: z.string().optional(),
});

const customEventSchemaWithoutKey = baseEventSchemaWithoutKey.extend({
  event: z.literal(EventType.CUSTOM),
  name: z.string().min(1),
  journey: z.string().optional(),
  value: z.number().optional(),
});

const userBehaviorEventSchemaWithoutKey = baseEventSchemaWithoutKey.extend({
  event: z.literal(EventType.USER_BEHAVIOR),
  behaviorType: z.string().min(1),
  journey: z.string().optional(),
  step: z.string().optional(),
  feature: z.string().optional(),
  elementSelector: z.string().optional(),
  elementText: z.string().optional(),
  pageUrl: z.string().optional(),
  value: z.number().optional(),
});

const trackPayloadSchemaWithoutKey = z.discriminatedUnion('event', [
  journeyEventSchemaWithoutKey,
  featureEventSchemaWithoutKey,
  satisfactionEventSchemaWithoutKey,
  customEventSchemaWithoutKey,
  userBehaviorEventSchemaWithoutKey,
]);

/**
 * Batch track schema
 */
export const batchTrackPayloadSchema = z.object({
  projectKey: z.string().min(1),
  events: z.array(trackPayloadSchemaWithoutKey),
});

/**
 * Identify payload schema
 */
export const identifyPayloadSchema = z.object({
  projectKey: z.string().min(1),
  userId: z.string().min(1),
  sessionId: z.string().uuid(),
  traits: z.record(z.any()).optional(),
});

/**
 * Validation helpers
 */
export const validateTrackPayload = (data: unknown) => {
  return trackPayloadSchema.safeParse(data);
};

export const validateBatchTrackPayload = (data: unknown) => {
  return batchTrackPayloadSchema.safeParse(data);
};

export const validateIdentifyPayload = (data: unknown) => {
  return identifyPayloadSchema.safeParse(data);
};

