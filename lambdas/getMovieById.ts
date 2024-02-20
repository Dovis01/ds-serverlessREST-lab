import {APIGatewayProxyHandlerV2} from "aws-lambda";
import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient, GetCommand, QueryCommand} from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {     // Note change
    try {
        console.log("Event: ", event);
        const parameters = event?.pathParameters;
        const movieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
        const includeCast = event?.queryStringParameters?.cast === 'true';

        if (!movieId) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({Message: "Missing movie Id"}),
            };
        }

        const movieCommandOutput = await ddbDocClient.send(
            new GetCommand({
                TableName: process.env.MOVIES_TABLE,
                Key: {id: movieId},
            })
        );

        console.log("GetCommand response: ", movieCommandOutput);

        if (!movieCommandOutput.Item) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({Message: "Invalid movie Id"}),
            };
        }

        const body = {
            data: movieCommandOutput.Item,
        };

        if (includeCast) {
            const castCommandOutput = await ddbDocClient.send(
                new QueryCommand({
                    TableName: process.env.MOVIE_CAST_TABLE,
                    KeyConditionExpression: 'movieId = :movieId',
                    ExpressionAttributeValues: {
                        ':movieId': movieId,
                    },
                })
            );

            console.log("CastCommand response: ", castCommandOutput);

            if (castCommandOutput.Items && castCommandOutput.Items.length > 0) {
                body.data.cast = castCommandOutput.Items;
            } else {
                body.data.cast = "No cast information found for this movie.";
            }
        }

        // Return Response
        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(body),
        };
    } catch (error: any) {
        console.log(JSON.stringify(error));
        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({error}),
        };
    }
};

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({region: process.env.REGION});
    const marshallOptions = {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
        wrapNumbers: false,
    };
    const translateConfig = {marshallOptions, unmarshallOptions};
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
