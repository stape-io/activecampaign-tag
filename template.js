const BigQuery = require('BigQuery');
const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getContainerVersion = require('getContainerVersion');
const getRequestHeader = require('getRequestHeader');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeString = require('makeString');
const Promise = require('Promise');
const sendHttpRequest = require('sendHttpRequest');

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
  createOrUpdateContactRequest()
    .then((result) => {
      if (!result.success) return [result];

      const actions = [];
      const responseBody = JSON.parse(result.body || '{}');

      if (
        data.updateContactListStatus &&
        responseBody &&
        responseBody.contact &&
        responseBody.contact.id
      ) {
        actions.push(updateContactListStatus(responseBody.contact.id));
      }

      if (data.type === 'createOrUpdateContactTrackEvent') {
        actions.push(sendEventRequest());
      }

      return actions.length > 0 ? Promise.all(actions) : [{ success: true }];
    })
    .then((results) => {
      return results.every((result) => result.success) ? data.gtmOnSuccess() : data.gtmOnFailure();
    })
    .catch(() => {
      return data.gtmOnFailure();
    });
} else if (data.type === 'trackEvent') {
  sendEventRequest()
    .then((result) => (result.success ? data.gtmOnSuccess() : data.gtmOnFailure()))
    .catch(() => data.gtmOnFailure());
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function createOrUpdateContactRequest() {
  const createOrUpdateContactEndpoint = generateRequestUrl(data, 'createOrUpdateContact');
  const requestOptions = generateRequestOptions(data, 'createOrUpdateContact');
  const bodyData = {
    contact: {
      email: data.email
    }
  };

  const fieldValues = (data.fieldValues || []).filter((item) => {
    const valueType = getType(item.value);
    return valueType !== 'undefined' && valueType !== 'null';
  });

  if (fieldValues.length) bodyData.contact.fieldValues = fieldValues;
  if (data.firstName) bodyData.contact.firstName = data.firstName;
  if (data.lastName) bodyData.contact.lastName = data.lastName;
  if (data.phone) bodyData.contact.phone = data.phone;

  log({
    Name: 'ActiveCampaign',
    Type: 'Request',
    EventName: 'CreateOrUpdateContact',
    RequestMethod: requestOptions.method,
    RequestUrl: url,
    RequestBody: bodyData
  });

  return sendHttpRequest(createOrUpdateContactEndpoint, requestOptions, JSON.stringify(bodyData))
    .then((result) => {
      log({
        Name: 'ActiveCampaign',
        Type: 'Response',
        EventName: 'CreateOrUpdateContact',
        ResponseStatusCode: result.statusCode,
        ResponseHeaders: result.headers,
        ResponseBody: result.body
      });

      if (result.statusCode >= 200 && result.statusCode < 300) {
        return { success: true, body: result.body };
      } else {
        return { success: false };
      }
    })
    .catch(() => {
      log({
        Name: 'ActiveCampaign',
        Type: 'Error',
        EventName: 'CreateOrUpdateContact',
        Message: 'Error creating or updating contact.'
      });
      return { success: false };
    });
}

function updateContactListStatus(contactId) {
  if (!contactId) return Promise.create((_, reject) => reject({ success: false }));

  const updateContactListStatusEndpoint = generateRequestUrl(data, 'updateContactListStatus');
  const requestOptions = generateRequestOptions(data, 'updateContactListStatus');
  const bodyData = {
    contactList: {
      list: makeString(data.listId),
      contact: makeString(contactId),
      status: data.contactStatus === 'unsubscribe' ? '2' : '1',
      sourceid: data.contactStatus === 'resubscribe' ? '4' : '0'
    }
  };

  log({
    Name: 'ActiveCampaign',
    Type: 'Request',
    EventName: 'UpdateContactListStatus',
    RequestMethod: requestOptions.method,
    RequestUrl: updateContactListStatusEndpoint,
    RequestBody: bodyData
  });

  return sendHttpRequest(updateContactListStatusEndpoint, requestOptions, JSON.stringify(bodyData))
    .then((result) => {
      log({
        Name: 'ActiveCampaign',
        Type: 'Response',
        EventName: 'UpdateContactListStatus',
        ResponseStatusCode: result.statusCode,
        ResponseHeaders: result.headers,
        ResponseBody: result.body
      });

      if (result.statusCode >= 200 && result.statusCode < 300) {
        return { success: true };
      } else {
        return { success: false };
      }
    })
    .catch(() => {
      log({
        Name: 'ActiveCampaign',
        Type: 'Error',
        EventName: 'UpdateContactListStatus',
        Message: 'Error updating contact list status.'
      });
      return { success: false };
    });
}

function sendEventRequest() {
  const trackEventEndpoint = generateRequestUrl(data, 'trackEvent');
  const requestOptions = generateRequestOptions(data, 'trackEvent');
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
    RequestMethod: requestOptions.method,
    RequestUrl: url,
    RequestBody: bodyData
  });

  return sendHttpRequest(trackEventEndpoint, requestOptions, bodyData)
    .then((result) => {
      log({
        Name: 'ActiveCampaign',
        Type: 'Response',
        EventName: data.event,
        ResponseStatusCode: result.statusCode,
        ResponseHeaders: result.headers,
        ResponseBody: result.body
      });

      if (result.statusCode >= 200 && result.statusCode < 300) {
        return { success: true };
      } else {
        return { success: false };
      }
    })
    .catch(() => {
      log({
        Name: 'ActiveCampaign',
        Type: 'Error',
        EventName: data.event,
        Message: 'Error sending event.'
      });
      return { success: false };
    });
}

function generateRequestUrl(data, requestType) {
  if (requestType === 'trackEvent') return 'https://trackcmp.net/event';

  const baseUrl =
    'https://' +
    encodeUriComponent(data.apiUrl.replace('http://', '').replace('https://', '')) +
    '/api/3';

  if (requestType === 'createOrUpdateContact') return baseUrl + '/contact/sync';
  if (requestType === 'updateContactListStatus') return baseUrl + '/contactLists';
}

function generateRequestOptions(data, requestType) {
  const method = 'POST';
  if (requestType === 'trackEvent') {
    return {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: method
    };
  }

  return { headers: { 'Api-Token': data.apiKey }, method: method };
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
