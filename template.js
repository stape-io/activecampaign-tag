const sendHttpRequest = require('sendHttpRequest');
const encodeUriComponent = require('encodeUriComponent');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const getContainerVersion = require('getContainerVersion');
const getRequestHeader = require('getRequestHeader');

const containerVersion = getContainerVersion();
const isDebug = containerVersion.debugMode;
const traceId = isDebug ? getRequestHeader('trace-id') : undefined;


if (data.type === 'createOrUpdateContact' || data.type === 'createOrUpdateContactTrackEvent') {
  let url = 'https://' + encodeUriComponent(data.apiUrl.replace('http://', '').replace('https://', '')) + '/api/3/contact/sync';
  let method = 'POST';
  let bodyData = {
    "contact": {
      "email": data.email,
      "fieldValues": data.fieldValues
    }
  };

  if (data.firstName) {
    bodyData.contact.firstName = data.firstName;
  }

  if (data.lastName) {
    bodyData.contact.lastName = data.lastName;
  }

  if (data.phone) {
    bodyData.contact.phone = data.phone;
  }

  if (isDebug) {
    logToConsole(JSON.stringify({
      'Name': 'ActiveCampaign',
      'Type': 'Request',
      'TraceId': traceId,
      'RequestMethod': method,
      'RequestUrl': url,
      'RequestBody': bodyData,
    }));
  }

  sendHttpRequest(url, (statusCode, headers, body) => {
    if (statusCode >= 200 && statusCode < 300) {
      if (data.type === 'createOrUpdateContactTrackEvent') {
        sendEventRequest();
      } else {
        data.gtmOnSuccess();
      }
    } else {
      data.gtmOnFailure();
    }
  }, {headers: {'Api-Token': data.apiKey}, method: method, timeout: 3500}, JSON.stringify(bodyData));
} else {
  sendEventRequest();
}


function sendEventRequest()
{
  let url = 'https://trackcmp.net/event';
  let method = 'POST';
  let bodyData = 'actid='+encodeUriComponent(data.actid)+'&key='+encodeUriComponent(data.eventKey)+'&event='+encodeUriComponent(data.event)+'&visit='+encodeUriComponent('{"email":"'+data.email+'"}');

  if (data.eventdata) {
    bodyData = bodyData + '&eventdata='+encodeUriComponent(data.eventdata);
  }

  if (isDebug) {
    logToConsole(JSON.stringify({
      'Name': 'ActiveCampaign',
      'Type': 'Request',
      'TraceId': traceId,
      'RequestMethod': method,
      'RequestUrl': url,
      'RequestBody': bodyData,
    }));
  }

  sendHttpRequest(url, (statusCode, headers, body) => {
    if (statusCode >= 200 && statusCode < 300) {
      data.gtmOnSuccess();
    } else {
      data.gtmOnFailure();
    }
  }, {headers: {'content-type': 'application/x-www-form-urlencoded'}, method: method, timeout: 3500}, bodyData);
}
