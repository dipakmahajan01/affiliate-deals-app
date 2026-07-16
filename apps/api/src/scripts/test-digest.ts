import 'dotenv/config';
import { connectDB } from '../db';
import { sendDigestToAllUsers } from '../services/digest';

connectDB().then(async () => {
  console.log(await sendDigestToAllUsers());
  process.exit(0);
});
