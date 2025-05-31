import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';

export enum JoinRequestDecision {
  APPROVE = 'approve',
  DECLINE = 'decline',
}

export class RespondToJoinRequestDto {
  @ApiProperty({
    description: 'The decision to approve or decline the join request',
    enum: JoinRequestDecision,
    example: JoinRequestDecision.APPROVE,
  })
  @IsNotEmpty()
  @IsEnum(JoinRequestDecision)
  decision: JoinRequestDecision;
}
