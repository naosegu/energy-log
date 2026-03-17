exports.handler = async (event) => {
  console.log('event:', JSON.stringify(event, null, 2));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
    },
    body: JSON.stringify({
      message: 'Energy Log API is working',
      method: event.requestContext?.http?.method ?? null,
      path: event.rawPath ?? null,
    }),
  };
};
