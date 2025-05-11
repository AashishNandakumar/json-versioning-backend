# JSON Versioning Backend

Backend for the JSON Versioning App using Node.js, Express, and MongoDB.

## Tech Stack
- Node.js (LTS)
- Express.js
- MongoDB (with Mongoose)
- dotenv, cors

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the root with your MongoDB URI:
   ```env
   MONGODB_URI=mongodb://localhost:27017/json_versioning
   PORT=5000
   ```
3. Start the server:
   ```bash
   npm run dev
   ```

## Folder Structure
```
src/
  controllers/
  models/
  routes/
  services/
  middlewares/
  utils/
  config/
  app.js
  server.js
```

## API Endpoints
See frontend `/json-versioning/src/services/api.ts` for endpoint documentation.
