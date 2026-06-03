const cloudbase = require("@cloudbase/node-sdk");

const COLLECTION_NAME = "analytics_payloads2";

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});

const db = app.database();

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildWarnings(payload) {
  const warnings = [];

  if (!isPlainObject(payload.identity)) {
    warnings.push("missing_identity");
  }

  if (!isPlainObject(payload.session)) {
    warnings.push("missing_session");
  }

  if (!Array.isArray(payload.events)) {
    warnings.push("events_not_array");
  }

  return warnings;
}

exports.main = async function main(event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (event.httpMethod === "OPTIONS" || event.method === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  if ((event.httpMethod || event.method) !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        ok: false,
        stored: false,
        error: "method_not_allowed",
      }),
    };
  }

  try {
    let payload = event.body;

    if (typeof payload === "string") {
      payload = JSON.parse(payload || "{}");
    }

    if (!isPlainObject(payload)) {
      throw new Error("payload must be an object");
    }

    const receivedAt = new Date().toISOString();
    const safeEvents = Array.isArray(payload.events) ? payload.events : [];
    const safeIdentity = isPlainObject(payload.identity) ? payload.identity : {};
    const safeSession = isPlainObject(payload.session) ? payload.session : {};
    const safeSurvey = isPlainObject(payload.survey) ? payload.survey : null;
    const surveyAnswers = safeSurvey && isPlainObject(safeSurvey.answers) ? safeSurvey.answers : {};
    const warnings = buildWarnings(payload);
    const eventTypes = safeEvents
      .map((item) => (isPlainObject(item) && typeof item.event_type === "string" ? item.event_type.trim() : ""))
      .filter(Boolean);
    const sessionId = safeSession.session_id || null;
    const testerUuid = safeIdentity.tester_uuid || null;
    const doc = {
      received_at: receivedAt,
      server_ts: new Date(),
      mode: "cloudbase_analytics_ingest",
      session_id: sessionId,
      tester_uuid: testerUuid,
      tester_id: safeIdentity.tester_id || null,
      tester_level: Number.isFinite(safeIdentity.tester_level) ? safeIdentity.tester_level : null,
      tester_level_text: safeIdentity.tester_level_text || "",
      client_version: safeIdentity.client_version || safeSession.client_version || null,
      session_index: Number.isFinite(safeSession.session_index)
        ? safeSession.session_index
        : (Number.isFinite(safeIdentity.session_index) ? safeIdentity.session_index : null),
      event_count: safeEvents.length,
      event_types: eventTypes,
      has_survey: Boolean(safeSurvey),
      survey_submitted: safeSurvey && safeSurvey.submitted === true,
      survey_skipped: safeSurvey && safeSurvey.skipped === true,
      interview_willing: surveyAnswers.interview_willing === true,
      warnings,
      payload,
    };
    const result = await db.collection(COLLECTION_NAME).add(doc);
    const docId = result && (result.id || result._id) ? (result.id || result._id) : null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        mode: "cloudbase_analytics_ingest",
        stored: true,
        collection: COLLECTION_NAME,
        doc_id: docId,
        session_id: sessionId,
        tester_uuid: testerUuid,
        event_count: safeEvents.length,
        received_at: receivedAt,
        warnings,
      }),
    };
  } catch (error) {
    const isPayloadError = error instanceof SyntaxError || error.message === "payload must be an object";
    return {
      statusCode: isPayloadError ? 400 : 500,
      headers,
      body: JSON.stringify({
        ok: false,
        stored: false,
        error: isPayloadError ? "invalid_payload" : "db_write_failed",
        message: error.message,
      }),
    };
  }
};
