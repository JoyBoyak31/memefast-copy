// src/utils/pumpFunAPI.js
import axios from 'axios';

const API_BASE_URL = 'https://pumpportal.fun/api';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { accept: 'application/json' }
});

export const fetchTrendingTokens = (limit = 20) =>
  axiosInstance.get('/tokens/trending', { params: { limit } })
               .then(res => res.data)
               .catch(e => { throw new Error(e); });

export const fetchTokenDetails = (address) =>
  axiosInstance.get(`/tokens/${address}`)
               .then(res => res.data)
               .catch(e => { throw new Error(e); });

export default { fetchTrendingTokens, fetchTokenDetails };