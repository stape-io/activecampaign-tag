# ActiveCampaign tag for Google Tag Manager Server Side

The **ActiveCampaign tag for the Google Tag Manager server container** allows you to integrate your website with ActiveCampaign by sending event and user data directly to the ActiveCampaign API.

This server-to-server integration helps improve data accuracy and security by communicating directly with ActiveCampaign from your server, bypassing client-side tracking limitations.

## Features

The tag supports three main actions:

- Track event
- Create or update contact
- Create or update contact and track event

## How to use

1.  Add the **ActiveCampaign Tag** to your GTM Server container from the Template Gallery.
2.  Create a new tag and select the **Action** you want to perform (e.g., "Create or update contact and track event").
3.  Provide the necessary information depending on the action being tracked (**ActiveCampaign API URL**, **API Key**, **Event Key**, **Actid** etc.).
4.  Map the required fields, such as **Email** for contacts and **Event Name** for events.
5.  Configure additional user or event data as needed.
6.  Set up a trigger to fire the tag on the relevant server-side event (e.g., a `purchase` or `generate_lead` event).

## Useful Resources

- [How to integrate ActiveCampaign with your website using a server GTM container](https://stape.io/blog/how-to-integrate-activecampaign-with-the-website-using-google-tag-manager-server-container)

## Open Source

The **ActiveCampaign Tag for GTM Server Side** is developed and maintained by [Stape Team](https://stape.io/) under the Apache 2.0 license.
