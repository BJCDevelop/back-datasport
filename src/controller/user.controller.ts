import { Request, Response } from "express";
import { nanoid } from "nanoid";
import { CreateUserInput, forgotPasswordInput, resetPasswordInput, VerifyUserInput } from "../schema/user.schema";
import { createUser, findUserById, findUserByEmail } from "../service/user.service";
import log from "../utils/logger";
import sendEmail from "../utils/mailer"

export async function createUserHandler(
    req: Request<{}, {}, CreateUserInput>,
    res: Response
    ){

    const body = req.body;
    
    try {
        const user = await createUser(body);

        await sendEmail({
            from: 'test@example.com',
            to: user.email,
            subject: "Please verify your account",
            text: `Verification code: ${user.verificationCode}. Id: ${user._id}`
        });

        return res.send("User successfully created");
    } catch (e: any) {
        if (e.code === 11000){
            return res.status(409).send("Account alredy exists");
        }

        return res.status(500).send(e);
        
    }
}

export async function verifyUserHandler(req: Request<VerifyUserInput>, res: Response){
    const id = req.params.id
    const verificationCode = req.params.verificationCode

    // Find the user by id
    const user = await findUserById(id)

    if(!user){
        return res.send("Could not verify user")
    }

    // Check to see if the are already verified
    if(user.verified){
        return res.send("User is already verified")
    }

    // Check to see if the verificationCode matches
    if(user.verificationCode === verificationCode){
        user.verified = true

        await user.save()

        return res.send("User successfully verified")
    }

    return res.send("Could not verify user")
    
}

export async function forgotPasswordHandler(req: Request<{}, {}, forgotPasswordInput>, res: Response){
    const message = "If a user with that email is registered you will receive a password reset email";
    
    const {email} = req.body

    const user = await findUserByEmail(email)

    if(!user){
        log.debug(`User with email ${email} does not exist`);
        return res.send(`User with email ${email} does not exist`)
    }

    if(!user.verified){
        return res.send("User is not verified");
    }

    const passwordResetCode = nanoid()

    user.passwordResetCode = passwordResetCode

    await user.save()

    await sendEmail({
        to: user.email,
        from: "test@example.com",
        subject: "Reset your password",
        text: `Password reset code ${passwordResetCode}. Id ${user._id}`,
    });

    log.debug(`Password reset email sent to ${email}`);

    return res.send(message);
}

export async function resetPasswordHandler(req: Request<resetPasswordInput["params"], {}, resetPasswordInput["body"]>, res: Response){
    const {id, passwordResetCode} = req.params
    
    const {password} = req.body

    const user = await findUserById(id);

    if(!user || !user.passwordResetCode || user.passwordResetCode !== passwordResetCode){
        return res.sendStatus(400).send("Could not reset user password");
    }

    user.passwordResetCode = null

    user.password = password

    await user.save();

    return res.send("Successfully updated user password");
}

export async function getCurrentUserHandler(req: Request, res: Response){
    return res.send(res.locals.user);
}