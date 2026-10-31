import { manejarApi } from '@/api/router';

export default {
  fetch(peticion: Request): Promise<Response> {
    return manejarApi(peticion);
  },
};
