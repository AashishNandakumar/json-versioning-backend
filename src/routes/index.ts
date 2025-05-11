import express from 'express';
import documentRoutes from './document';
import authRoutes from './auth';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/documents', documentRoutes);

export default router;
