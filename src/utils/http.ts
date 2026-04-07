import axios from 'axios';
// import { ElNotification, ElMessage } from 'element-plus';
// import { loading } from '@/utils/index';

const config = {
    baseURL: (import.meta.env.VITE_API_BASE_URL ?? '').trim() || 'http://127.0.0.1:8080/',
    timeout: 60 * 1000, // Timeout
    withCredentials: false // Check cross-site Access-Control
};

const _axios = axios.create(config);

// const loadingRef = ref(null);
// 添加一个请求拦截器
_axios.interceptors.request.use(
    function (config) {
        // const loadingValue = config?.loading;
        // if (typeof loadingValue !== 'boolean') {
        //     loadingRef.value?.close();
        //     loadingRef.value = null;
        //     loadingRef.value = loading();
        // }
        // Do something before request is sent
        // config.headers['Authorization'] = localStorage.getItem('Authorization');
        return config;
    },
    function (error) {
        // loadingRef.value?.close();
        // loadingRef.value = null;
        // Do something with request error
        return Promise.reject(error);
    }
);

// 添加一个响应拦截器
_axios.interceptors.response.use(
    function (response) {
        // loadingRef.value?.close();
        // loadingRef.value = null;
        const { code, msg } = response.data;

        if (code == 1) {
            return response.data;
        } else {
            // ElMessage.error(`${msg}`);
            return Promise.reject(`${code}`);
        }
    },
    function (error) {
        // loadingRef.value?.close();
        // loadingRef.value = null;
        // Do something with response error
        if (!error.response) {
            // ElNotification.error({ message: `${error.name}:${error.message}` });
        }
        return Promise.reject(error);
    }
);

export default _axios;

