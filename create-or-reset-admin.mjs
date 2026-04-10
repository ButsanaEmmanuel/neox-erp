import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const email = 'ebutsana@neox.io'
const password = 'Neox2026#Secure'
const passwordHash = bcrypt.hashSync(password, 10)

async function main() {
  let user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        username: email,
        name: 'Emmanuel BUTSANA',
        passwordHash,
        isActive: true,
        isDeleted: false,
        hasSystemAccess: true,
        forcePasswordChange: false,
      },
    })
    console.log('User created:', user.email)
  } else {
    user = await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        isActive: true,
        isDeleted: false,
        hasSystemAccess: true,
        forcePasswordChange: false,
      },
    })
    console.log('User updated:', user.email)
  }

  // role admin (best effort)
  try {
    const role = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'System Administrator' },
    })

    const existing = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: role.id },
    })

    if (!existing) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id, isActive: true },
      })
      console.log('ADMIN role linked')
    } else {
      console.log('ADMIN role already linked')
    }
  } catch (e) {
    console.log('Role link skipped:', e.message)
  }

  console.log('LOGIN =>', email, '/', password)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
