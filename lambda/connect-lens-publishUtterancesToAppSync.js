const https = require('https');
const AWS = require('aws-sdk');
const urlParse = require('url').URL;

const region = process.env.AWS_REGION;
const apiKey = process.env.APPSYNC_API_KEY;
const appsyncUrl = process.env.APPSYNC_API_URL;
const endpoint = new urlParse(appsyncUrl).hostname.toString();
const graphqlQuery = `mutation Publish2channel($data: AWSJSON!, $name: String!) {
  publish2channel(data: $data, name: $name) {
    data
    name
  }
}
`;

exports.handler = async (event, context) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  for (const record of event.Records) {
    // Kinesis data is base64 encoded so decode here
    const payload = Buffer.from(record.kinesis.data, 'base64').toString(
      'ascii'
    );
    console.log('Decoded payload:', payload);
    var JSONpayload = JSON.parse(payload);
    const req = new AWS.HttpRequest(appsyncUrl, region);

    const details = {
      data: payload,
      name: JSONpayload.ContactId,
    };

    req.method = 'POST';
    req.path = '/graphql';
    req.headers.host = endpoint;
    req.headers['Content-Type'] = 'application/json';
    req.body = JSON.stringify({
      query: graphqlQuery,
      operationName: 'Publish2channel',
      variables: details,
    });

    if (apiKey) {
      req.headers['x-api-key'] = apiKey;
    } else {
      const signer = new AWS.Signers.V4(req, 'appsync', true);
      signer.addAuthorization(AWS.config.credentials, AWS.util.date.getDate());
    }

    const data = await new Promise((resolve, reject) => {
      const httpRequest = https.request(
        { ...req, host: endpoint },
        (result) => {
          let data = '';

          result.on('data', (chunk) => {
            data += chunk;
          });

          result.on('end', () => {
            resolve(JSON.parse(data.toString()));
            console.log('In here');
            console.log(JSON.parse(data.toString()));
          });
        }
      );

      httpRequest.write(req.body);
      httpRequest.end();
    });
  }

  return `Successfully published ${event.Records.length} records.`;
};
