import axios from 'axios'

export const rentcastClient = axios.create({
  baseURL: 'https://api.rentcast.io/v1',
  headers: {
    'X-API-KEY': process.env.RENTCAST_API_KEY
  }
})
