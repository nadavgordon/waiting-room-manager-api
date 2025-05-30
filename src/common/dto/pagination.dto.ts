import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * `PaginationDto` defines the structure for pagination query parameters
 * typically sent by clients to request paginated data.
 * It uses `class-validator` for input validation and `class-transformer` for type conversion.
 */
export class PaginationDto {
  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

/**
 * `PaginatedResponseDto` is a generic Data Transfer Object (DTO) used to standardize
 * the structure of paginated API responses. It encapsulates the actual data items
 * along with comprehensive metadata about the pagination state, allowing clients
 * to easily render pagination controls and understand the dataset size.
 *
 * @template T The type of the individual data items contained within the `data` array.
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Array of items for the current page' })
  data: T[];

  @ApiProperty({ description: 'Total number of items across all pages' })
  totalItems: number;

  @ApiProperty({ description: 'Number of items on the current page' })
  itemCount: number;

  @ApiProperty({ description: 'Number of items per page' })
  itemsPerPage: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Current page number' })
  currentPage: number;

  /**
   * Constructs a `PaginatedResponseDto` instance.
   * @param data The array of items for the current page.
   * @param totalItems The total count of all items available in the dataset.
   * @param itemsPerPage The configured number of items per page.
   * @param currentPage The current page number being returned.
   */
  constructor(data: T[], totalItems: number, itemsPerPage: number, currentPage: number) {
    this.data = data;
    this.totalItems = totalItems;
    this.itemCount = data.length;
    this.itemsPerPage = itemsPerPage;
    this.currentPage = currentPage;
    this.totalPages = Math.ceil(totalItems / itemsPerPage);
  }
}