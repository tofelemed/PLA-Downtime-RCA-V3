import * as dotenv from 'dotenv';
import * as path from 'path';

// Jest may be launched from any directory; the backend .env lives two levels up from test/integration.
// Variables already present in the environment (CI) win over the file.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
