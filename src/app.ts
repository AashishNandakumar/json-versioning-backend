import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes';

dotenv.config();

const app: Application = express();

app.use(cors());
app.use(express.json());

// TODO: Add routes
// app.use('/api/documents', require('./routes/documentRoutes'));

app.use('/api', router);

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK' });
});

export default app;
