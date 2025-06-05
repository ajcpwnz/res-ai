import { Router } from 'express'
import authRoutes from './auth'
import propertyRoutes from './properties'

const router = Router()

router.use('/auth', authRoutes)
router.use('/properties', propertyRoutes)

export default router
