const sendHttpRequest = require('sendHttpRequest');
const encodeUriComponent = require('encodeUriComponent');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const getContainerVersion = require('getContainerVersion');
const getRequestHeader = require('getRequestHeader');
const getType = require('getType');

const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = isLoggingEnabled ? getRequestHeader('trace-id') : undefined;

if (
  data.type === 'createOrUpdateContact' ||
  data.type === 'createOrUpdateContactTrackEvent'
) {
  let url =
    'https://' +
    encodeUriComponent(
      data.apiUrl.replace('http://', '').replace('https://', '')
    ) +
    '/api/3/contact/sync';
  let method = 'POST';
  let bodyData = {
    contact: {
      email: data.email,
    },
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

  if (isLoggingEnabled) {
    logToConsole(
      JSON.stringify({
        Name: 'ActiveCampaign',
        Type: 'Request',
        EventName: 'CreateOrUpdateContact',
        TraceId: traceId,
        RequestMethod: method,
        RequestUrl: url,
        RequestBody: bodyData,
      })
    );
  }

  sendHttpRequest(
    url,
    (statusCode, headers, body) => {
      if (isLoggingEnabled) {
        logToConsole(
          JSON.stringify({
            Name: 'ActiveCampaign',
            Type: 'Response',
            EventName: 'CreateOrUpdateContact',
            TraceId: traceId,
            ResponseStatusCode: statusCode,
            ResponseHeaders: headers,
            ResponseBody: body,
          })
        );
      }
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

function sendEventRequest() {
  let url = 'https://trackcmp.net/event';
  let method = 'POST';
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

  if (isLoggingEnabled) {
    logToConsole(
      JSON.stringify({
        Name: 'ActiveCampaign',
        Type: 'Request',
        EventName: data.event,
        TraceId: traceId,
        RequestMethod: method,
        RequestUrl: url,
        RequestBody: bodyData,
      })
    );
  }

  sendHttpRequest(
    url,
    (statusCode, headers, body) => {
      if (isLoggingEnabled) {
        logToConsole(
          JSON.stringify({
            Name: 'ActiveCampaign',
            Type: 'Response',
            EventName: data.event,
            TraceId: traceId,
            ResponseStatusCode: statusCode,
            ResponseHeaders: headers,
            ResponseBody: body,
          })
        );
      }
      if (statusCode >= 200 && statusCode < 300) {
        data.gtmOnSuccess();
      } else {
        data.gtmOnFailure();
      }
    },
    {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: method,
      timeout: 3500,
    },
    bodyData
  );
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
