import axios from 'axios'

export const censusClient = axios.create({
  baseURL: 'https://api.census.gov/data/2023/acs/acs5',
})
