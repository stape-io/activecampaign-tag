const sendHttpRequest = require('sendHttpRequest');
const encodeUriComponent = require('encodeUriComponent');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const getContainerVersion = require('getContainerVersion');
const getRequestHeader = require('getRequestHeader');
const getType = require('getType');
const getAllEventData = require('getAllEventData');
const BigQuery = require('BigQuery');
const getTimestampMillis = require('getTimestampMillis');

/*==============================================================================
==============================================================================*/

const eventData = getAllEventData();

if (!isConsentGivenOrNotRequired(data, eventData)) {
  return data.gtmOnSuccess();
}

const url = getUrl(eventData);
if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
  return data.gtmOnSuccess();
}

if (data.type === 'createOrUpdateContact' || data.type === 'createOrUpdateContactTrackEvent') {
  const url =
    'https://' +
    encodeUriComponent(data.apiUrl.replace('http://', '').replace('https://', '')) +
    '/api/3/contact/sync';
  const method = 'POST';
  const bodyData = {
    contact: {
      email: data.email
    }
  };

  const fieldValues = (data.fieldValues || []).filter((item) => {
    const valueType = getType(item.value);
    return valueType !== 'undefined' && valueType !== 'null';
  });

  if (fieldValues.length) {
    bodyData.contact.fieldValues = fieldValues;
  }

  if (data.firstName) {
    bodyData.contact.firstName = data.firstName;
  }

  if (data.lastName) {
    bodyData.contact.lastName = data.lastName;
  }

  if (data.phone) {
    bodyData.contact.phone = data.phone;
  }

  log({
    Name: 'ActiveCampaign',
    Type: 'Request',
    EventName: 'CreateOrUpdateContact',
    RequestMethod: method,
    RequestUrl: url,
    RequestBody: bodyData
  });

  sendHttpRequest(
    url,
    (statusCode, headers, body) => {
      log({
        Name: 'ActiveCampaign',
        Type: 'Response',
        EventName: 'CreateOrUpdateContact',
        ResponseStatusCode: statusCode,
        ResponseHeaders: headers,
        ResponseBody: body
      });

      if (statusCode >= 200 && statusCode < 300) {
        if (data.type === 'createOrUpdateContactTrackEvent') {
          sendEventRequest();
        } else {
          data.gtmOnSuccess();
        }
      } else {
        data.gtmOnFailure();
      }
    },
    { headers: { 'Api-Token': data.apiKey }, method: method, timeout: 3500 },
    JSON.stringify(bodyData)
  );
} else {
  sendEventRequest();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function sendEventRequest() {
  const url = 'https://trackcmp.net/event';
  const method = 'POST';
  let bodyData =
    'actid=' +
    encodeUriComponent(data.actid) +
    '&key=' +
    encodeUriComponent(data.eventKey) +
    '&event=' +
    encodeUriComponent(data.event) +
    '&visit=' +
    encodeUriComponent('{"email":"' + data.email + '"}');

  if (data.eventdata) {
    bodyData = bodyData + '&eventdata=' + encodeUriComponent(data.eventdata);
  }

  log({
    Name: 'ActiveCampaign',
    Type: 'Request',
    EventName: data.event,
    RequestMethod: method,
    RequestUrl: url,
    RequestBody: bodyData
  });

  sendHttpRequest(
    url,
    (statusCode, headers, body) => {
      log({
        Name: 'ActiveCampaign',
        Type: 'Response',
        EventName: data.event,
        ResponseStatusCode: statusCode,
        ResponseHeaders: headers,
        ResponseBody: body
      });

      if (statusCode >= 200 && statusCode < 300) {
        data.gtmOnSuccess();
      } else {
        data.gtmOnFailure();
      }
    },
    {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: method,
      timeout: 3500
    },
    bodyData
  );
}

/*==============================================================================
  Helpers
==============================================================================*/

function getUrl(eventData) {
  return eventData.page_location || eventData.page_referrer || getRequestHeader('referer');
}

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function log(rawDataToLog) {
  const logDestinationsHandlers = {};
  if (determinateIsLoggingEnabled()) logDestinationsHandlers.console = logConsole;
  if (determinateIsLoggingEnabledForBigQuery()) logDestinationsHandlers.bigQuery = logToBigQuery;

  rawDataToLog.TraceId = getRequestHeader('trace-id');

  const keyMappings = {
    // No transformation for Console is needed.
    bigQuery: {
      Name: 'tag_name',
      Type: 'type',
      TraceId: 'trace_id',
      EventName: 'event_name',
      RequestMethod: 'request_method',
      RequestUrl: 'request_url',
      RequestBody: 'request_body',
      ResponseStatusCode: 'response_status_code',
      ResponseHeaders: 'response_headers',
      ResponseBody: 'response_body'
    }
  };

  for (const logDestination in logDestinationsHandlers) {
    const handler = logDestinationsHandlers[logDestination];
    if (!handler) continue;

    const mapping = keyMappings[logDestination];
    const dataToLog = mapping ? {} : rawDataToLog;

    if (mapping) {
      for (const key in rawDataToLog) {
        const mappedKey = mapping[key] || key;
        dataToLog[mappedKey] = rawDataToLog[key];
      }
    }

    handler(dataToLog);
  }
}

function logConsole(dataToLog) {
  logToConsole(JSON.stringify(dataToLog));
}

function logToBigQuery(dataToLog) {
  const connectionInfo = {
    projectId: data.logBigQueryProjectId,
    datasetId: data.logBigQueryDatasetId,
    tableId: data.logBigQueryTableId
  };

  dataToLog.timestamp = getTimestampMillis();

  ['request_body', 'response_headers', 'response_body'].forEach((p) => {
    dataToLog[p] = JSON.stringify(dataToLog[p]);
  });

  BigQuery.insert(connectionInfo, [dataToLog], { ignoreUnknownValues: true });
}

function determinateIsLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
    containerVersion &&
    (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}

function determinateIsLoggingEnabledForBigQuery() {
  if (data.bigQueryLogType === 'no') return false;
  return data.bigQueryLogType === 'always';
}
