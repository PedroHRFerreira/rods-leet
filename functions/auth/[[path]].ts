import { handleBff } from "../_lib/bff";
export const onRequest: PagesFunction<BffEnv> = (context) =>
  handleBff(context.request, context.env);
