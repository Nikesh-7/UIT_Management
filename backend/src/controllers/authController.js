const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

// ==========================================
// HELPER: VALIDATE DATE OF BIRTH
// ==========================================
const isSameDate = (storedDate, inputDate) => {
    if (!storedDate || !inputDate) return false;

    if (typeof inputDate !== 'string') return false;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
        return false;
    }

    const [year, month, day] = inputDate.split('-').map(Number);

    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    // Reject invalid calendar dates
    if (
        parsedDate.getUTCFullYear() !== year ||
        parsedDate.getUTCMonth() !== month - 1 ||
        parsedDate.getUTCDate() !== day
    ) {
        return false;
    }

    const storedYear = storedDate.getUTCFullYear();
    const storedMonth = storedDate.getUTCMonth() + 1;
    const storedDay = storedDate.getUTCDate();

    return (
        storedYear === year &&
        storedMonth === month &&
        storedDay === day
    );
};


// ==========================================
// HELPER: GENERATE JWT
// ==========================================
const generateToken = (user) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is missing in environment variables');
    }

    return jwt.sign(
        {
            id: user.id,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '1d'
        }
    );
};


// ==========================================
// REGISTER STUDENT
// ==========================================
const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email and password are required'
            });
        }

        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least 8 characters'
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.toLowerCase().trim();

        const existingUser = await prisma.user.findUnique({
            where: { email: cleanEmail }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email is already registered'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                name: cleanName,
                email: cleanEmail,
                passwordHash,
                role: 'STUDENT'
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            user
        });

    } catch (error) {
        console.error('Registration error:', error);

        return res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
};


// ==========================================
// LOGIN: STUDENT / FACULTY / ADMIN
// ==========================================
const login = async (req, res) => {
    try {
        const { role } = req.body;

        let user = null;

        // ==================================
        // ADMIN LOGIN: EMAIL + PASSWORD
        // ==================================
        if (role === 'ADMIN') {
            const { email, password } = req.body;

            if (
                typeof email !== 'string' ||
                typeof password !== 'string' ||
                !email.trim() ||
                !password
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Admin email and password are required'
                });
            }

            user = await prisma.user.findFirst({
                where: {
                    email: email.toLowerCase().trim(),
                    role: 'ADMIN'
                }
            });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid admin email or password'
                });
            }

            const passwordMatch = await bcrypt.compare(
                password,
                user.passwordHash
            );

            if (!passwordMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid admin email or password'
                });
            }
        }

        // ==================================
        // STUDENT LOGIN: ROLL NUMBER + DOB
        // ==================================
        else if (role === 'STUDENT') {
            const { rollNumber, dateOfBirth } = req.body;

            if (
                typeof rollNumber !== 'string' ||
                !rollNumber.trim() ||
                typeof dateOfBirth !== 'string'
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Roll number and date of birth are required'
                });
            }

            user = await prisma.user.findFirst({
                where: {
                    role: 'STUDENT',
                    studentProfile: {
                        is: {
                            rollNumber: rollNumber.trim()
                        }
                    }
                },
                include: {
                    studentProfile: true
                }
            });

            const storedDOB = user?.studentProfile?.dateOfBirth;

            if (!user || !isSameDate(storedDOB, dateOfBirth)) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid roll number or date of birth'
                });
            }
        }

        // ==================================
        // FACULTY LOGIN: EMPLOYEE CODE + DOB
        // ==================================
        else if (role === 'STAFF') {
            const { employeeCode, dateOfBirth } = req.body;

            if (
                typeof employeeCode !== 'string' ||
                !employeeCode.trim() ||
                typeof dateOfBirth !== 'string'
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Faculty roll number and date of birth are required'
                });
            }

            user = await prisma.user.findFirst({
                where: {
                    role: 'STAFF',
                    staffProfile: {
                        is: {
                            employeeCode: employeeCode.trim()
                        }
                    }
                },
                include: {
                    staffProfile: true
                }
            });

            const storedDOB = user?.staffProfile?.dateOfBirth;

            if (!user || !isSameDate(storedDOB, dateOfBirth)) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid faculty roll number or date of birth'
                });
            }
        }

        // ==================================
        // INVALID ROLE
        // ==================================
        else {
            return res.status(400).json({
                success: false,
                message: 'Please select a valid login role'
            });
        }

        // ==================================
        // GENERATE TOKEN
        // ==================================
        const token = generateToken(user);

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);

        return res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
};


// ==========================================
// GET LOGGED-IN USER
// ==========================================
const getMe = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,

                studentProfile: {
                    select: {
                        id: true,
                        rollNumber: true,
                        dateOfBirth: true,
                        departmentId: true
                    }
                },

                staffProfile: {
                    select: {
                        id: true,
                        employeeCode: true,
                        dateOfBirth: true,
                        departmentId: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            user
        });

    } catch (error) {
        console.error('Get user error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to fetch user'
        });
    }
};


// ==========================================
// EXPORT
// ==========================================
module.exports = {
    register,
    login,
    getMe
};