import User from "../models/userModel.js"

import bcrypt from "bcryptjs"
import Notification from "../models/notifications.js"

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function getUserProfile(req, res){
    const { username } = req.params;

    try {
        const user = await User.findOne({username}).select("-password");
        if(!user){
            return res.status(404).json({
                error: "user not found"
            });
        }
        return res.status(200).json(user); 
    } catch (error) {
        console.log("error in getUserProfile controller", error);
        return res.status(500).json({
            error: "Internal server error"
        })
    }
}

export async function followUnfollow(req,res){
    try{
        const { id } = req.params;
        const userToModify =  await User.findById(id);
        const currentUser = await User.findById(req.user._id); //already logged in user

        if(id === req.user._id){
            return res.status(400).json({
                error: "You cannot follow/ unfollow yourself"
            })
        }

        if(!userToModify || !currentUser){
            return res.status(404).json({
                error: "User not found"
            })
        }

        const isFollowing = currentUser.following.includes(id); //let's check if user is following someone

        if(isFollowing){
            //I do the unfollow logic here
            await User.findByIdAndUpdate(id, {$pull: {followers: req.user._id}}); //I delete from the followers array if user isFollowing is true
            await User.findByIdAndUpdate(req.user._id, {$pull : { following: id}}); //let's delete from the following array
            return res.status(200).json({
                message: "User unfollowed successfully"
            })
        }else{
            //I do the follow logic here
            await User.findByIdAndUpdate(id, {$push: {followers: req.user._id}}); // I add to the followers array if user isFollowing is false
            await User.findByIdAndUpdate(req.user._id, {$push : { following: id}}); // I add to the following array
            const newNotification = new Notification({
                type: "follow",
                from: req.user._id,
                to: userToModify._id
            });

            await newNotification.save();
            return res.status(200).json({
                message: "User followed successfully"
            })
        }
    }catch(error){
        console.log("error in followUnfollow controller", error);
        return res.status(500).json({
            error: "Internal server error"
        })
    }
}
//This logic is very tricky, I seriously need to get more of it🥵
export async function getSuggestedUsers(req,res){
    try{
        const userId = req.user._id;

        const usersFollowedByMe = await User.findById(userId).select("following");

        const users = await User.aggregate([ //aggregate is a method that helps to process data records and return computed results
            {
                $match: {
                    _id: {$ne: userId}, // here i am saying dont suggest myself
                },
            },
            {
                $sample: { size: 10 }, // here i am saying get me 10 random users from the database
            }
        ]);

        const filteredUsers = users.filter((user)=> !usersFollowedByMe.following.includes(user._id));// here i am saying dont suggest people i am already following
        const suggestedUsers = filteredUsers.slice(0, 4); // here i am saying get me only 4 users from the filtered users

        suggestedUsers.forEach((user)=>(user.password=null)); // here i am saying dont send password to the frontend even if its hashed

        return res.status(200).json(suggestedUsers);

    }catch(error){
        console.log("error in getSuggestedUsers controller", error);
        return res.status(500).json({
            error: "Internal server error"
        });
    }
}

export async function updateUser(req, res){
    const { username, email, currentPassword, newPassword, bio, link, fullname } = req.body;

    let { profileImg, coverImg } = req.body;

    const userId = req.user._id;
    try {
        const user = await User.findById(userId);
        if(!user){
            return res.status(404).json({
                error: "user not found"
            })
        }

        if((!newPassword && currentPassword) || (!currentPassword && newPassword)){
            return res.status(400).json({
                error: "Please provide current password and new password"
            })
        }
        
        if(currentPassword && newPassword){
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if(!isMatch){
                return res.status(400).json({
                    error: "Current password is incorrect"
                })
            }
            if(newPassword.length<6){
                return res.status(400).json({
                    error: " password must be 6 or more"
                })
            }

            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(newPassword, salt);
        }
        //upload profile and cover images to cloudinary
        if(profileImg){
            if(user.profileImg){ //if user already has a profile image, I need to delete it from cloudinary to prevent unused images from piling up
                const publicId = user.profileImg.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(publicId);
            }
            const profileImgResponse = await cloudinary.uploader.upload(profileImg);
            profileImg = profileImgResponse.secure_url;
        }

        if(coverImg){
            if(user.coverImg){ //same logic as above for cover image
                const publicId = user.coverImg.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(publicId);
            }
            const coverImgResponse = await cloudinary.uploader.upload(coverImg);
            coverImg = coverImgResponse.secure_url;
        }

        user.username = username || user.username;
        user.email = email || user.email;
        user.bio = bio || user.bio;
        user.link = link || user.link;
        user.fullname = fullname || user.fullname;
        user.profileImg = profileImg || user.profileImg;
        user.coverImg = coverImg || user.coverImg;

        await user.save();

        user.password = null; //to not send password back to the frontend

        return res.status(200).json(user);



    } catch (error) {
        console.log("error in updateUser controller", error.message);
        return res.status(500).json({
            error: "Internal server error"
        })
    }
}