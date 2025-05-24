import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { AuthRequest } from '../middlewares/auth';

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = '7d';

// Helper to format user object for response (exclude password)
function userToResponse(user: IUser) {
  return {
    _id: user._id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required.' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'Email already registered.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.status(201).json({ success: true, token, user: userToResponse(user) });
  } catch (err) {
    console.error('Error in register:', err);
    return res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ success: true, token, user: userToResponse(user) });
  } catch (err) {
    console.error('Error in login:', err);
    return res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

export const validate = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Invalid token.' });
    }
    return res.json({ success: true, user: userToResponse(req.user) });
  } catch (err) {
    // This catch block in 'validate' seems to be for specific token validation errors (401)
    // rather than unexpected 500 errors. So, it might be best to leave its message specific,
    // or clarify if this too should be generic. For now, assuming only 500 errors get generic messages.
    // If this should also be generic for any error, the line below should be changed.
    console.error('Error in validate:', err); // Added logging
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  // Stateless JWT: logout is handled on client, but endpoint provided for API contract
  return res.json({ success: true, message: 'Logged out.' });
};
