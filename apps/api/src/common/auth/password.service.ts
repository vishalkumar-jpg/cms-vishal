import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";

/** Password hashing (bcrypt). Pure-JS bcryptjs avoids native build issues. */
@Injectable()
export class PasswordService {
  private readonly rounds = 12;

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
