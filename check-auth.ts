
import { settings } from './src/config.js';

console.log('\n🔐 Authentication Configuration Check');
console.log('===================================');

if (settings.GOOGLE_API_KEY) {
    console.log('⚠️  Mode: API KEY');
    console.log('   Using static API key from GOOGLE_API_KEY.');
    console.log('   (To use Subscription Login, remove GOOGLE_API_KEY from .env)');
} else if (settings.GCP_PROJECT) {
    console.log('✅  Mode: SUBSCRIPTION LOGIN (Vertex AI)');
    console.log(`   Target Project: ${settings.GCP_PROJECT}`);
    console.log(`   Target Location: ${settings.GCP_LOCATION}`);
    console.log('\n   Status: Ready to use Application Default Credentials.');
    console.log('   Make sure you have run: "gcloud auth application-default login"');
} else {
    console.log('❌  Mode: UNCONFIGURED');
    console.log('   Neither GOOGLE_API_KEY nor GCP_PROJECT is set in .env');
}
console.log('===================================\n');
