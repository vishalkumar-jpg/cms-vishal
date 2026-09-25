import "reflect-metadata";
import { describe, expect, mock, test } from "bun:test";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";
import type { TemplateCatalogEntry } from "@ob-cms/template-registry";
import { TemplateCatalogController } from "../template-catalog.controller";
import type { TemplateCatalogService } from "../template-catalog.service";

const catalogEntry: TemplateCatalogEntry = {
  id: "tsk_home",
  templateKey: "tpl-homepage",
  displayName: "Homepage",
  description: "Primary marketing home",
  category: "marketing",
  supportedPageTypes: ["homepage"],
  tags: ["home"],
  version: "1.0.0",
  status: "published",
  createdAt: "2026-07-30T12:00:00.000Z",
  updatedAt: "2026-07-30T12:00:00.000Z",
};

function mockResponse(): Response {
  const res = {
    status: mock(function (this: typeof res) {
      return this;
    }),
    send: mock(function (this: typeof res) {
      return this;
    }),
  };
  return res as unknown as Response;
}

describe("TemplateCatalogController", () => {
  test("list delegates query to catalog service", async () => {
    const catalog = {
      list: mock(async () => [catalogEntry]),
    } as unknown as TemplateCatalogService;
    const controller = new TemplateCatalogController(catalog);
    const res = mockResponse();

    await controller.list({ category: "marketing", sort: "displayName" }, res);

    expect(catalog.list).toHaveBeenCalledWith({
      category: "marketing",
      sort: "displayName",
    });
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: [catalogEntry], status: StatusCodes.OK });
  });

  test("getByKey delegates templateKey to catalog service", async () => {
    const catalog = {
      getByKey: mock(async () => catalogEntry),
    } as unknown as TemplateCatalogService;
    const controller = new TemplateCatalogController(catalog);
    const res = mockResponse();

    await controller.getByKey("tpl-homepage", res);

    expect(catalog.getByKey).toHaveBeenCalledWith("tpl-homepage");
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: catalogEntry, status: StatusCodes.OK });
  });

  test("getById delegates id to catalog service", async () => {
    const catalog = {
      getById: mock(async () => catalogEntry),
    } as unknown as TemplateCatalogService;
    const controller = new TemplateCatalogController(catalog);
    const res = mockResponse();

    await controller.getById("tsk_home", res);

    expect(catalog.getById).toHaveBeenCalledWith("tsk_home");
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.send).toHaveBeenCalledWith({ data: catalogEntry, status: StatusCodes.OK });
  });
});
