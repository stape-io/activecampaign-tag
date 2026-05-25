const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getRequestHeader = require('getRequestHeader');
const getType = require('getType');
const JSON = require('JSON');
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

  return sendHttpRequest(createOrUpdateContactEndpoint, requestOptions, JSON.stringify(bodyData))
    .then((result) => {
      if (result.statusCode >= 200 && result.statusCode < 300) {
        return { success: true, body: result.body };
      } else {
        return { success: false };
      }
    })
    .catch(() => {
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

  return sendHttpRequest(updateContactListStatusEndpoint, requestOptions, JSON.stringify(bodyData))
    .then((result) => {
      if (result.statusCode >= 200 && result.statusCode < 300) {
        return { success: true };
      } else {
        return { success: false };
      }
    })
    .catch(() => {
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

  return sendHttpRequest(trackEventEndpoint, requestOptions, bodyData)
    .then((result) => {
      if (result.statusCode >= 200 && result.statusCode < 300) {
        return { success: true };
      } else {
        return { success: false };
      }
    })
    .catch(() => {
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
