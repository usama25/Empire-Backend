import * as bizSdk from 'facebook-nodejs-business-sdk';
import { config } from '@lib/fabzen-common/configuration';

const Content = bizSdk.Content;
const CustomData = bizSdk.CustomData;
const DeliveryCategory = bizSdk.DeliveryCategory;
const EventRequest = bizSdk.EventRequest;
const UserData = bizSdk.UserData;
const ServerEvent = bizSdk.ServerEvent;

const eventSourceUrl = config.meta.eventSourceUrl;
const accessToken = config.meta.accessToken;
const pixelId = config.meta.pixelId;

export async function sendRegistrationEventToMeta(
  externalId: string,
  ipAddr: string,
  country: string,
  phoneNumber: string,
) {
  if (config.isJest) {
    return;
  }
  const currentTimestamp = Math.floor(Date.now() / 1000); // Get current timestamp in seconds
  const userData = new UserData()
    .setPhones([phoneNumber])
    .setCountry(country)
    .setClientIpAddress(ipAddr)
    .setExternalId(externalId);

  const customData = new CustomData()
    .setCurrency('inr') // Example currency
    .setValue(0); // Registration event might not have a monetary value

  const serverEvent = new ServerEvent()
    .setEventName('CompleteRegistration')
    .setEventTime(currentTimestamp)
    .setUserData(userData)
    .setCustomData(customData)
    .setEventSourceUrl(eventSourceUrl) // Replace with your URL
    .setActionSource('website');

  const eventsData = [serverEvent];
  const eventRequest = new EventRequest(accessToken, pixelId).setEvents(
    eventsData,
  );

  try {
    const response = await eventRequest.execute();
    console.log('Registration:', response);
    return response;
  } catch (error) {
    console.error('Meta Register Error:', error);
  }
}

export async function sendPurchaseEventToMeta(
  externalId: string,
  ipAddr: string,
  country: string,
  email: string,
  phoneNumber: string,
  amount: string,
) {
  if (config.isJest) {
    return;
  }
  const currentTimestamp = Math.floor(Date.now() / 1000);

  const userData = new UserData()
    .setPhones([phoneNumber])
    .setCountry(country)
    .setClientIpAddress(ipAddr)
    .setEmail(email)
    .setExternalId(externalId);

  const content = new Content()
    .setId('wallet')
    .setQuantity(1)
    .setDeliveryCategory(DeliveryCategory.HOME_DELIVERY);

  const customData = new CustomData()
    .setContents([content])
    .setCurrency('inr')
    .setValue(Number.parseFloat(amount));

  const serverEvent = new ServerEvent()
    .setEventName('Purchase')
    .setEventTime(currentTimestamp)
    .setUserData(userData)
    .setCustomData(customData)
    .setEventSourceUrl(eventSourceUrl)
    .setActionSource('other');

  const eventsData = [serverEvent];
  const eventRequest = new EventRequest(accessToken, pixelId).setEvents(
    eventsData,
  );

  try {
    const response = await eventRequest.execute();
    console.log('Purchase:', response);
    return response;
  } catch (error) {
    console.error('Meta Purchase Error:', error);
  }
}

export async function sendAppInstallEventToMeta(
  externalId: string,
  ipAddr: string,
  country: string,
  phoneNumber: string,
) {
  if (config.isJest) {
    return;
  }
  const currentTimestamp = Math.floor(Date.now() / 1000);

  const userData = new UserData()
    .setPhones([phoneNumber])
    .setCountry(country)
    .setClientIpAddress(ipAddr)
    .setExternalId(externalId);

  const customData = new CustomData()
    .setContents([])
    .setCurrency('inr')
    .setValue(0);

  const serverEvent = new ServerEvent()
    .setEventName('AppInstall')
    .setEventTime(currentTimestamp)
    .setUserData(userData)
    .setCustomData(customData)
    .setEventSourceUrl(eventSourceUrl)
    .setActionSource('website');

  const eventsData = [serverEvent];
  const eventRequest = new EventRequest(accessToken, pixelId).setEvents(
    eventsData,
  );

  try {
    const response = await eventRequest.execute();
    console.log('InstallApp:', response);
    return response;
  } catch (error) {
    console.error('Meta Install Error:', error);
  }
}
