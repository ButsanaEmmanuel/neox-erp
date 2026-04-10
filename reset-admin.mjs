import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const email = 'ebutsana@neox.io'
const plain = 'Neox2026#Secure'

const hash = bcrypt.hashSync(plain, 10)

try {
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash: hash, isActive: true, isDeleted: false }
  })
  console.log('Password reset OK for:', user.email)
  console.log('Temporary password:', plain)
} catch (e) {
  console.error('Reset failed:', e.message)
} finally {
  await prisma.$disconnect()
}
