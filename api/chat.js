import {createCloudHandler} from '../server/cloud.js';
const handler=createCloudHandler();
export const GET=handler;
export const POST=handler;
export const maxDuration=60;
