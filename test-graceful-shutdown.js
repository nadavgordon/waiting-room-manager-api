// Simple script to test graceful shutdown
const { spawn } = require('child_process');
const process = require('process');

console.log('Starting application...');
const app = spawn('npm', ['run', 'start:dev'], { stdio: 'inherit' });

// Give the app some time to start up
setTimeout(() => {
  console.log('\n\n--- Sending SIGTERM to test graceful shutdown ---');
  app.kill('SIGTERM');
  
  // Wait a bit to see the shutdown logs
  setTimeout(() => {
    console.log('\nTest completed');
    process.exit(0);
  }, 3000);
}, 15000); // Wait 15 seconds before sending SIGTERM

app.on('exit', (code) => {
  if (code !== null) {
    console.log(`Application exited with code ${code}`);
  }
});

// Handle Ctrl+C to terminate both processes
process.on('SIGINT', () => {
  app.kill('SIGINT');
  process.exit(0);
});
