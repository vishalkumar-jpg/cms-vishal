import { describe, expect, test } from "bun:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCollectionDto, UpdateCollectionDto, UpdateCollectionDetailLayoutDto } from "../dto/collection.dto";

describe("collection detailLayout DTO (class-validator 0.14.1 IsOptional)", () => {
  test("CreateCollectionDto accepts omitted detailLayout", async () => {
    const dto = plainToInstance(CreateCollectionDto, { name: "Case Studies", slug: "case-studies" });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  test("CreateCollectionDto accepts null detailLayout", async () => {
    const dto = plainToInstance(CreateCollectionDto, {
      name: "Case Studies",
      slug: "case-studies",
      detailLayout: null,
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  test("CreateCollectionDto accepts object detailLayout", async () => {
    const dto = plainToInstance(CreateCollectionDto, {
      name: "Case Studies",
      slug: "case-studies",
      detailLayout: { root: "ROOT", nodes: {} },
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  test("CreateCollectionDto rejects non-object detailLayout", async () => {
    const dto = plainToInstance(CreateCollectionDto, {
      name: "Case Studies",
      slug: "case-studies",
      detailLayout: "not-an-object",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "detailLayout")).toBe(true);
  });

  test("UpdateCollectionDto accepts omitted detailLayout", async () => {
    expect(await validate(plainToInstance(UpdateCollectionDto, {}))).toEqual([]);
  });

  test("UpdateCollectionDto accepts null detailLayout", async () => {
    expect(
      await validate(plainToInstance(UpdateCollectionDto, { detailLayout: null })),
    ).toEqual([]);
  });

  test("UpdateCollectionDto accepts object detailLayout", async () => {
    expect(
      await validate(
        plainToInstance(UpdateCollectionDto, {
          detailLayout: { root: "ROOT", nodes: {} },
        }),
      ),
    ).toEqual([]);
  });

  test("UpdateCollectionDto rejects non-object detailLayout", async () => {
    const errors = await validate(
      plainToInstance(UpdateCollectionDto, { detailLayout: 42 }),
    );
    expect(errors.some((e) => e.property === "detailLayout")).toBe(true);
  });
});

describe("UpdateCollectionDetailLayoutDto", () => {
  test("accepts null detailLayout", async () => {
    expect(
      await validate(plainToInstance(UpdateCollectionDetailLayoutDto, { detailLayout: null })),
    ).toEqual([]);
  });

  test("accepts object detailLayout", async () => {
    expect(
      await validate(
        plainToInstance(UpdateCollectionDetailLayoutDto, {
          detailLayout: { root: "ROOT", nodes: {} },
        }),
      ),
    ).toEqual([]);
  });

  test("rejects non-object detailLayout", async () => {
    const errors = await validate(
      plainToInstance(UpdateCollectionDetailLayoutDto, { detailLayout: 42 }),
    );
    expect(errors.some((e) => e.property === "detailLayout")).toBe(true);
  });

  test("accepts omitted detailLayout at DTO layer; service rejects undefined", async () => {
    expect(
      await validate(plainToInstance(UpdateCollectionDetailLayoutDto, {})),
    ).toEqual([]);
  });
});
