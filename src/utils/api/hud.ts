import axios from 'axios'

export const hudClient = axios.create({
  baseURL: 'https://www.huduser.gov/hudapi/public/fmr',
  headers: {
    Authorization: `Bearer ${process.env.HUD_API_KEY}`
  }
})
