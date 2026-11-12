require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: "nikeshnp757@gmail.com" },
        select: {
            id: true,
            email: true,
            role: true
        }
    });

    console.log("ADMIN ACCOUNT:");
    console.log(user);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
