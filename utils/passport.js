import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import Limits from '../models/Limits.js';
import { defaultClassesLimit, defaultEvaluationLimit, defaultEvaluatorLimit } from './config.js';
import Settings from '../models/Settings.js';
import { defaultAIModel } from './models.js';
import { defaultPaymentGateway } from './payment.js';

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export const setupPassport = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/users/auth/google/callback',
        scope: [
          'profile', 
          'email',
          'https://www.googleapis.com/auth/classroom.courses',
          'https://www.googleapis.com/auth/classroom.coursework.me',
          'https://www.googleapis.com/auth/classroom.rosters',
          'https://www.googleapis.com/auth/classroom.profile.emails',
          'https://www.googleapis.com/auth/classroom.profile.photos'
        ],
        accessType: 'offline', // Important to get a refresh token
        prompt: 'consent' // Important to ensure refresh token is sent every time
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await User.findOne({ googleId: profile.id });
          
          if (user) {
            return done(null, user);
          }
          
          // Check if user exists with same email
          user = await User.findOne({ email: profile.emails[0].value });
          
          if (user) {
            // Update existing user with Google ID
            user.googleId = profile.id;
            user.authType = 'google';
            if (!user.profilePicture && profile.photos && profile.photos.length > 0) {
              user.profilePicture = profile.photos[0].value;
            }
            // Update tokens for existing user
            user.googleAccessToken = accessToken;
            if (refreshToken) {
              user.googleRefreshToken = refreshToken;
            }
            await user.save();
            return done(null, user);
          }
          
          // Create new user
          const users = await User.find();
          
          if (users.length === 0) {
            const settings = new Settings({
              aiModel: defaultAIModel,
              paymentGateway: defaultPaymentGateway,
            });
            
            await settings.save();
          }
          
          const newUser = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
            profilePicture: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : '',
            type: users.length === 0 ? 0 : 1, // First user is admin
            authType: 'google'
          });
          
          
          let savedUser = await newUser.save(); // Correctly save and assign newUser

          // Store tokens
          savedUser.googleAccessToken = accessToken;
          if (refreshToken) {
            savedUser.googleRefreshToken = refreshToken;
          }
          savedUser = await savedUser.save(); // Save again to store tokens
          
          const newLimits = new Limits({
            userId: savedUser._id,
            evaluatorLimit: defaultEvaluatorLimit,
            evaluationLimit: defaultEvaluationLimit,
            classesLimit: defaultClassesLimit,
          });
          
          await newLimits.save();
          
          return done(null, savedUser);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
};

export default passport;