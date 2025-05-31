import { IsUUID } from 'class-validator';

export class LeaveRoomDto {
  @IsUUID()
  roomId: string;
}
