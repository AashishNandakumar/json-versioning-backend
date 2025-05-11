import { RequestHandler, Router } from 'express';
import { register, login, validate, logout } from '../controllers/authController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.post('/register', register as unknown as RequestHandler);
router.post('/login', login as unknown as RequestHandler);
router.get('/validate', authenticateJWT as unknown as RequestHandler, validate as unknown as RequestHandler);
router.post('/logout', authenticateJWT as unknown as RequestHandler, logout as unknown as RequestHandler);

export default router;
