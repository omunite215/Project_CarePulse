import RegisterForm from "@/components/forms/RegisterForm";
import Image from "next/image";
import Link from "next/link";
import React from "react";

const Register = () => {
  return (
    <div className="flex h-screen max-h-screen">
      {/* TODO: OTP Verification */}
      <section className="remove-scrollbar container my-auto">
        <div className="sub-container max-w-[496px]">
          <Image
            src="/assets/icons/logo-full.svg"
            height={1000}
            width={1000}
            alt="patient"
            className="mb-12 h-10 w-fit"
          />
          <RegisterForm/>
          <div className="text-14-regular mt-20 flex justify-between">
            <p className="justify-items-end text-dark-600 xl:text-left">
              © 2024 CarePulse
            </p>
            <Link href="/?admin=true" className="text-green-500 hover:underline">
              Admin
            </Link>
          </div>
        </div>
      </section>
      <Image src="/assets/images/register-img.png" height={1000} width={1000} alt="patient" className="side-img max-w-[390px]" />
    </div>
  );
};

export default Register;
