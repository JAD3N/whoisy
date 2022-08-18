const { Client } = require('./build/cjs');

(async () => {
    const client = new Client();
    const record = await client.lookup('blackhouse.uk.com');
    console.log(record);
})();
