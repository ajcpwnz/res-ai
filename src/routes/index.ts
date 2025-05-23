import { Router } from 'express'
import propertyRoutes from './properties'

const router = Router()

router.use('/properties', propertyRoutes)

export default router
