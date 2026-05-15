import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth';

const router = Router();

router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', getMe);

export default router;
