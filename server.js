// Local development entry point — `npm start`.
// backend/index.js only self-listens when run directly, so listen here.
const app = require('./backend/index.js');
const config = require('./backend/config');

app.listen(config.port, function () {
  console.log('Carlington & Burling API listening on port ' + config.port);
});
