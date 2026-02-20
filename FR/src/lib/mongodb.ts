import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI environment variable is not set");

const options = {};

let client: MongoClient;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(uri, options);
  }
  client = global._mongoClient;
} else {
  client = new MongoClient(uri, options);
}

export default client;
