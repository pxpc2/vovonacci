import { restClient } from "@polygon.io/client-js";

const polygonClient = restClient(process.env.POLY_API_KEY as string);

export default polygonClient;
